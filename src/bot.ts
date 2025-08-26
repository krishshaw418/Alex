import dotenv from "dotenv";
dotenv.config();
import { Bot } from "grammy";

const kyroBot = new Bot(process.env.BOT_API_KEY!);

kyroBot.command("start", async (ctx) => {
  ctx.reply(`Welcome! Up and running.`);
});

kyroBot.on("message", async (ctx) => ctx.reply(`You said: ${ctx.message.text}`));

kyroBot.start();