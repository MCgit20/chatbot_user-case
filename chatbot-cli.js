// chatbot-cli.js
import 'dotenv/config';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const rl = readline.createInterface({ input, output });

async function askMistral(userMessage) {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
        },
        body: JSON.stringify({
            model: "mistral-tiny",
            messages: [{ role: "user", content: userMessage }]
        })
    });
    const data = await response.json();
    return data.choices[0].message.content;
}

async function main() {
    console.log("Chatbot CLI — Phase 1. (Ctrl+C pour quitter)");
    while (true) {
        const query = await rl.question('Vous : ');
        if (!query.trim()) continue;
        const response = await askMistral(query);
        console.log(`IA : ${response}`);
    }
}

main();