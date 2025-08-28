import dotenv from "dotenv";
dotenv.config();
import { Bot } from "grammy";
import { GoogleGenerativeAI, type Part } from '@google/generative-ai';
import type { User, File } from 'grammy/types';

const bot = new Bot(process.env.BOT_API_KEY!);
const genAi = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!)

const model = genAi.getGenerativeModel({
  model:'gemini-2.5-flash-lite',
  systemInstruction: 'You are Alex, a Telegram Chatbot. Maintain a friendly tone. Keep responses one paragraph short unless told otherwise. You have the ability to respond to audio and images.'
})

const chat = model.startChat();

bot.command('start', async (ctx) => {
  const user: User | undefined = ctx.from;
  const fullName: string = `${user?.username}`;
  const prompt: string = `Welcome user with the fullname ${fullName} in one sentence.`;
  const result = await chat.sendMessage(prompt);
  return ctx.reply(result.response.text(), { parse_mode: 'Markdown' });
});

bot.on('message:text', async (ctx) => {
  const prompt: string = ctx.message.text;
  const result = await chat.sendMessage(prompt);
  return ctx.reply(result.response.text(), {parse_mode: "Markdown"});
})

bot.on('message:voice', async (ctx) => {
  const file: File = await ctx.getFile();
  const filePath: string | undefined = file.file_path;
  if (!filePath) return;
  const fileUrl: string = `${process.env.BOT_API_SERVER}/file/bot${process.env.BOT_API_KEY}/${filePath}`;
  const response = await fetch(fileUrl);
  const data: ArrayBuffer = await response.arrayBuffer();
  const base64Audio: string = Buffer.from(data).toString('base64');

  const prompt: Array<string | Part> = [
    {
      inlineData: {
        mimeType: 'audio/ogg',
        data: base64Audio,
      },
    },
    {
      text: 'Please respond to the audio prompt.',
    },
  ];

  const result = await chat.sendMessage(prompt);
  return ctx.reply(result.response.text(), { parse_mode: 'Markdown' });
})

type MINE = 'image/jpeg' | 'image/png';
const ExtToMINE: Record<string, MINE> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
};

bot.on('message:photo', async (ctx) => {
  const caption: string | undefined = ctx.message.caption;
  const photoFile: File = await ctx.getFile();
  console.log(photoFile);
  const photoFilePath: string | undefined = photoFile.file_path;
  if (!photoFilePath) return;

  const photoURL: string = `${process.env.BOT_API_SERVER}/file/bot${process.env.BOT_API_KEY}/${photoFilePath}`;
  const fetchedResponse = await fetch(photoURL);

  const data: ArrayBuffer = await fetchedResponse.arrayBuffer();
  const base64Photo: string = Buffer.from(data).toString('base64');
  let match: RegExpMatchArray | null = photoFilePath.match(/[^.]+$/);
  if (!match) return;

  let photoExt: string = match[0];
  const prompt: Array<string | Part> = [
    { inlineData: { mimeType: ExtToMINE[photoExt] as string, data: base64Photo } },
    { text: caption ?? 'Describe what you see in the photo' },
  ];
const result = await chat.sendMessage(prompt);
  return ctx.reply(result.response.text(), { parse_mode: 'Markdown' });
});

bot.catch((error) => {
  const ctx = error.ctx;
  console.log(error);
  return ctx.reply('Something went wrong. Try again!');
});

bot.start();