import dotenv from "dotenv";
dotenv.config();
import { Bot, InlineKeyboard, Context, session, type SessionFlavor } from "grammy";

// To manage the session data
interface SessionData {
  action?: "pay" | "receive";
  awaitingUpi?: boolean;
}

// Context Flavoring
type MyContext = Context & SessionFlavor<SessionData>;

const kyroBot = new Bot<MyContext>(process.env.BOT_API_KEY!);

// Initialize Session
kyroBot.use(session({initial: (): SessionData=>({})}))

kyroBot.command("start", async (ctx) => {
  ctx.reply(`Welcome! ${ctx.message?.from.username} Please select the action you want to perform: `, {
    reply_markup: new InlineKeyboard()
    .text("💸 Make a payment", "pay")
    .text("📥 Request a payment", "receive")
    .row()
    // .text("Learn more", "about")
  });
});

kyroBot.callbackQuery("pay", async(ctx) => {
  ctx.session.action = "pay";
  ctx.session.awaitingUpi = true;
  await ctx.answerCallbackQuery();
  await ctx.reply("Please provide a valid UPI ID to proceed with payment 💳");
})

kyroBot.callbackQuery("receive", async(ctx) => {
  ctx.session.action = "receive";
  ctx.session.awaitingUpi = true;
  await ctx.answerCallbackQuery();
  await ctx.reply("Please provide a valid UPI ID to request a payment 📥");
})

kyroBot.start();