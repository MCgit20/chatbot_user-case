// chatbot-cli.js
import 'dotenv/config';
import readline from 'node:readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

async function askMistral(userMessage) {
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages: [{ role: 'user', content: userMessage }],
      temperature: 0.7
    })
  });
  const data = await response.json();
  return data.choices[0].message.content;
}

// On ajoute l'historique en haut du fichier
const history = [
  { role: 'system', content: 'Tu es un assistant utile et concis.' }
];

async function chat(userMessage) {
  history.push({ role: 'user', content: userMessage });

  const response = await fetch(currentProvider.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${currentProvider.key}`
    },
    body: JSON.stringify({
      model: currentProvider.model,
      messages: history,
      temperature: 0.7
    })
  });

  const data = await response.json();
  const reply = data.choices[0].message.content;
  
  history.push({ role: 'assistant', content: reply });
  return reply;
}

async function chatStream(userMessage) {
  history.push({ role: 'user', content: userMessage });

  const response = await fetch(currentProvider.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${currentProvider.key}`
    },
    body: JSON.stringify({
      model: currentProvider.model,
      messages: history,
      stream: true
    })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';

  process.stdout.write('IA : ');
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

    for (const line of lines) {
      const jsonStr = line.slice(6);
      if (jsonStr.trim() === '[DONE]') continue;

      try {
        const parsed = JSON.parse(jsonStr);
        const delta = parsed.choices[0]?.delta?.content;
        if (delta) {
          process.stdout.write(delta);
          fullContent += delta;
        }
      } catch (e) { /* Chunk partiel */ }
    }
  }
  process.stdout.write('\n\n');
  history.push({ role: 'assistant', content: fullContent });
}

const PROVIDERS = {
  mistral: {
    url: 'https://api.mistral.ai/v1/chat/completions',
    key: process.env.MISTRAL_API_KEY,
    model: 'mistral-small-latest'
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: process.env.GROQ_API_KEY,
    model: 'llama-3.3-70b-versatile'
  }
};

let currentProvider = PROVIDERS.mistral;

async function main() {
  console.log('--- Chatbot CLI Phase 4 (Providers) ---');
  while (true) {
    const input = await question('Vous : ');
    if (input.toLowerCase() === 'exit') break;
    
    const reply = await chatStream(input);
    console.log(`IA : ${reply}\n`);
    if (input.startsWith('/provider')) {
  const name = input.split(' ')[1];
  if (PROVIDERS[name]) {
    currentProvider = PROVIDERS[name];
    console.log(`Provider changé pour : ${name}`);
  }
  continue;
}
  }
  
}

main();