require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const express = require('express');

// Initialize Express App
const app = express();

// Initialize Telegram Bot
const bot = new Telegraf(process.env.BOT_TOKEN);

// Function to download file from GoFile
async function downloadFileFromGoFile(link) {
    // Extract the file ID from the link
    const fileId = link.split('/d/')[1];
    if (!fileId) {
        throw new Error("Invalid GoFile link");
    }

    // Construct the download URL
    const apiUrl = `https://api.gofile.io/getContent?contentId=${fileId}`;

    try {
        // Send a request to get file information
        const response = await axios.get(apiUrl);
        
        console.log("API Response:", response.data); // Log API response for debugging
        
        if (response.data.status !== 'ok') {
            throw new Error(`Error: ${response.data.message}`);
        }

        // Get the file information
        const fileInfo = response.data.data.contents[0];
        if (!fileInfo) {
            throw new Error("No contents found in the response.");
        }

        const fileLink = fileInfo.link;

        // Download the file
        const fileResponse = await axios.get(fileLink, { responseType: 'stream' });
        const fileName = fileInfo.name;

        // Save the file
        const filePath = path.join(__dirname, fileName);
        const writer = fs.createWriteStream(filePath);
        fileResponse.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log(`Downloaded ${fileName}`);
                resolve(filePath);
            });
            writer.on('error', reject);
        });
    } catch (error) {
        console.error(`Failed to download file: ${error.message}`);
        throw error; // Propagate the error
    }
}

// Telegram bot commands
bot.start((ctx) => ctx.reply('Welcome! Use /leech <GoFile_Link> to leech a file.'));

bot.command('leech', async (ctx) => {
    const message = ctx.message.text.split(' ');

    if (message.length !== 2 || !message[1].includes('gofile.io/d/')) {
        return ctx.reply('Please provide a valid GoFile link in the format: /leech <GoFile_Link>');
    }

    const goFileLink = message[1];

    try {
        // Step 1: Download file from GoFile
        await ctx.reply('Downloading your file...');
        const filePath = await downloadFileFromGoFile(goFileLink);
        
        // Step 2: Send file to the user
        await ctx.replyWithDocument({ source: filePath });
        
        // Step 3: Delete the file after sending
        fs.unlinkSync(filePath);
    } catch (error) {
        ctx.reply(`Failed to download or send the file: ${error.message}`);
    }
});

// Start Express server and bot
app.get('/', (req, res) => {
    res.send('Telegram Bot is running.');
});

// Launch Express server on port 3000
app.listen(process.env.PORT || 3000, () => {
    console.log('Server is running on port 3000');
    bot.launch(); // Start the bot
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
