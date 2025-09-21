import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { Bot, webhookCallback, GrammyError, type Context } from "grammy";
import { GoogleGenAI, type Part } from '@google/genai';
import type { User, File } from 'grammy/types';
import {
  type Conversation,
  type ConversationFlavor,
  conversations,
  createConversation,
} from "@grammyjs/conversations";

// Bot setup
const bot = new Bot<ConversationFlavor<Context>>(process.env.BOT_API_KEY!);
bot.use(conversations());

const genAi = new GoogleGenAI({
  vertexai: false,
  apiKey: process.env.GOOGLE_GEMINI_API_KEY!,
});

const chats = genAi.chats.create({
  model: "gemini-2.5-flash-lite",
  config: {
    systemInstruction: "You are Alex, a FEMALE Telegram Chatbot built for assisting with queries. You are built by Krish, a chill Dev. Maintain a friendly tone. Keep responses one paragraph short, unless asked otherwise. You have the ability to respond to audios and images as well."
  },
})


// Express setup
const app = express();
app.use(express.json());

// Attach bot webhook handler to Express
app.use("/webhook", webhookCallback(bot, "express"));

// Handlers
bot.command('start', async (ctx) => {
  const user: User | undefined = ctx.from;
  const fullName: string = `${user?.username}`;
  const prompt: string = `Greet the user with the fullname ${fullName} in one sentence.`;
  const response = await chats.sendMessage({
    message: prompt
  })
  if(!response.text) {
    return ctx.reply("Server busy. Please try again after sometime.");
  }
  return ctx.reply(response.text, { parse_mode: 'Markdown' });
});

bot.command('help', async (ctx) => {
  const message = `🤖 AI Helper Bot - Commands

  /start - Start a session and ask me general queries.
  (Note: I can't answer real-time stuff like date, time, weather etc.)

  /generate - Turn your text prompt into an image.
  (You'll choose a style after giving a prompt.)

  Type /help anytime to see this menu again. 🚀`;

  await ctx.reply(message);
})

// defining the conversation
async function imaGen(conversation: Conversation, ctx: Context) {
  await ctx.reply("Please describe your image.");
  const promptCtx: Context = await conversation.waitFor("message:text");
  const prompt = promptCtx.message?.text;
  let style: string = ""; 

  const styleMenu = conversation.menu()
    .text("anime", async (ctx) => {
      style = "anime";
      await ctx.reply("Selected anime!");
      ctx.menu.close();
    })
    .text("flux-dev", async (ctx) => {
      style = "flux-dev";
      await ctx.reply("Selected flux-dev!");
      ctx.menu.close();
    })
    .row()
    .text("flux-schnell", async (ctx) => {
      style = "flux-schnell";
      await ctx.reply("Selected flux-schnell!");
      ctx.menu.close();
    })
    .text("flux-dev-fast", async (ctx) => {
      style = "flux-dev-fast";
      await ctx.reply("Selected flux-dev-fast!");
      ctx.menu.close();
    })
    .row()
    .text("realistic", async (ctx) => {
      style = "realistic";
      await ctx.reply("Selected realistic!");
      ctx.menu.close();
    });

  await ctx.reply("Please select a style for your image: ", {
    reply_markup: styleMenu,
  });

  await conversation.wait();
  const payload = { prompt, style };
  console.log(payload);

  await ctx.reply("Processing your request. Hold tight!");
  await conversation.halt();
}

// Registering the conversation
bot.use(createConversation(imaGen));

bot.command('generate', async (ctx) => {
  try {
    // initializing conversation
    await ctx.conversation.enter("imaGen");
  } catch (error) {
    if(error instanceof GrammyError) {
      console.log("Error: ", error.message);
      return;
    }
  }
})

bot.on('message:text', async (ctx) => {
  const prompt: string = ctx.message.text;
  const response = await chats.sendMessage({
    message: prompt
  })
  if(!response.text) {
    return ctx.reply("Server busy. Please try again after sometime.");
  }
  try {
    ctx.reply(response.text, {parse_mode: "Markdown"});
  } catch (error) {
    if(error instanceof GrammyError) {
      console.log("Error from text handler: ", error.message);
      return;
    }
  }
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

  const result = await chats.sendMessage({
    message: prompt
  });
  if(!result.text) {
    return ctx.reply("Server busy. Please try again after sometime.");
  }
  try {
    ctx.reply(result.text, { parse_mode: 'Markdown' });
  } catch (error) {
    if(error instanceof GrammyError) {
      console.log("Error from audio handler", error.message);
      return;
    }
  }
})

type MINE = 'image/jpeg' | 'image/png' | 'video/mp4' | 'video/webm';
const ExtToMINE: Record<string, MINE> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  mp4: 'video/mp4',
  webm: 'video/webm',
};

bot.on('message:photo', async (ctx) => {
  const caption: string | undefined = ctx.message.caption;
  const photoFile: File = await ctx.getFile();
  console.log(photoFile);
  const photoFilePath: string | undefined = photoFile.file_path;
  if (!photoFilePath) return;

  const photoURL: string = `${process.env.BOT_API_SERVER}/file/bot${process.env.BOT_API_KEY}/${photoFilePath}`;
  const fetchedResponse = await fetch(photoURL);
  if(!fetchedResponse.ok){
    return;
  }

  const data: ArrayBuffer = await fetchedResponse.arrayBuffer();
  const base64Photo: string = Buffer.from(data).toString('base64');
  let match: RegExpMatchArray | null = photoFilePath.match(/[^.]+$/);
  if (!match) return;

  let photoExt: string = match[0];
  const prompt: Array<string | Part> = [
    { inlineData: { mimeType: ExtToMINE[photoExt] as string, data: base64Photo } },
    { text: caption ?? 'Describe what you see in the photo' },
  ];
  const result = await chats.sendMessage({
    message: prompt
  });
  if(!result.text){
    return ctx.reply("Server busy. Please try again after sometime.");
  }
  try {
    ctx.reply(result.text, { parse_mode: 'Markdown' });
  } catch (error) {
    if(error instanceof GrammyError) {
      console.log("Error from image handler: ", error.message);
      return;
    }
  }
});

bot.on('message:video', async (ctx) => {
  const caption: string | undefined = ctx.message.caption;
  const videoFile: File = await ctx.getFile();
  console.log(videoFile);
  const VideoFilePath: string | undefined = videoFile.file_path;
  const videoURL = `${process.env.BOT_API_SERVER}/file/bot/${process.env.BOT_API_KEY}/${VideoFilePath}`;
  if(!VideoFilePath) return;
  const fetchedResponse = await fetch(videoURL);
  const data: ArrayBuffer = await fetchedResponse.arrayBuffer();
  const base64Video: string = Buffer.from(data).toString('base64');
  let match: RegExpMatchArray | null = VideoFilePath.match(/[^.]+$/);
  if (!match) return;

  let videoExt: string = match[0].toLowerCase();
  console.log(videoExt);
  const prompt: Array<string | Part> = [
    { inlineData: { mimeType: ExtToMINE[videoExt] as string, data: base64Video } },
    { text: caption ?? 'Describe what you see in the video' },
  ];
  const result = await chats.sendMessage({
    message: prompt
  });
  if(!result.text){
    return ctx.reply("Server busy. Please try again after sometime.");
  }
  return ctx.reply(result.text, { parse_mode: 'Markdown' });
})

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}/webhook`;
  await bot.api.setWebhook(webhookUrl);
  console.log(`Webhook set to ${webhookUrl}`);
})