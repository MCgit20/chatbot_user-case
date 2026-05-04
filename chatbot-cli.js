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

let history = [
    { role: 'system', content: 'Tu es un assistant qui a une excellente mémoire.' }
];

async function chat(userMessage) {
    // 1. On ajoute le message de l'utilisateur à l'historique
    history.push({ role: 'user', content: userMessage });

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
        },
        body: JSON.stringify({
            model: "mistral-tiny",
            messages: history, // 2. ON ENVOIE TOUT LE TABLEAU, pas juste userMessage
            stream: false
        })
    });

    const data = await response.json();
    
    if (!data.choices) {
        console.log("Erreur API:", data);
        return "Désolé, j'ai eu un problème.";
    }

    const reply = data.choices[0].message.content;

    // 3. IMPORTANT : On ajoute la réponse de l'IA à l'historique pour le prochain tour
    history.push({ role: 'assistant', content: reply });

    return reply;
}

async function chatStream(userMessage) {
    history.push({ role: 'user', content: userMessage });
    process.stdout.write('IA : ');

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
        },
        body: JSON.stringify({
            model: "mistral-tiny",
            messages: history,
            stream: true
        })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullReply = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                const data = JSON.parse(line.slice(6));
                const content = data.choices[0].delta.content || "";
                process.stdout.write(content);
                fullReply += content;
            }
        }
    }
    process.stdout.write('\n');
    history.push({ role: 'assistant', content: fullReply });
    return fullReply;
}

async function main() {
    console.log("Chatbot CLI — Phase 3 (Streaming).");

    while (true) {
        const query = await rl.question('Vous : ');

        if (query === '/history') {
            console.log(JSON.stringify(history, null, 2));
            continue;
        }

        const response = await chat(query);
        console.log(`IA : ${response}`);
    }
}
main();