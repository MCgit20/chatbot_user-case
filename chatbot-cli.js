import 'dotenv/config';
import readline from 'node:readline';

// ---  SETUP & CONFIGURATION ---
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

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
const MAX_HISTORY = 10; // Seuil pour déclencher la Phase 5

// L'historique avec le system prompt initial (Phase 2)
const history = [
  { role: 'system', content: 'Tu es un assistant utile et concis.' }
];

// ---  COMMANDE DE RÉSUMÉ (Phase 6) ---

async function generateResume() {
  if (history.length <= 1) {
    console.log("[Système] Rien à résumer pour le moment.\n");
    return;
  }

  console.log('\n--- 📝 Résumé de la conversation (en cours...) ---');

  // On prépare la discussion sous forme de texte
  const conversationString = history
    .slice(1)
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

  try {
    const response = await fetch(currentProvider.url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${currentProvider.key}` 
      },
      body: JSON.stringify({
        model: currentProvider.model,
        messages: [
          { 
            role: 'system', 
            content: 'Tu es un assistant spécialisé en synthèse. Résume la discussion fournie en 5 points clés maximum. Chaque point doit commencer par un verbe d\'action. Style bullet points uniquement.' 
          },
          { role: 'user', content: conversationString }
        ],
        temperature: 0.3 // Température basse pour la précision factuelle
      })
    });

    const data = await response.json();
    console.log(data.choices[0].message.content);
    console.log('--------------------------------------------------\n');
    // NOTE : On ne push RIEN dans history ici car c'est une commande externe[cite: 1]
  } catch (error) {
    console.error('[Erreur Resume]', error.message);
  }
}

// ---  LOGIQUE DE COMPRESSION (Phase 5) ---
async function compressHistory() {
  // On ne compresse que si on dépasse le seuil défini[cite: 1]
  if (history.length <= MAX_HISTORY) return;

  console.log('\n[Système] 🗜️ Contexte trop long. Résumé en cours...');

  // Construction de la chaîne de caractères pour le résumé[cite: 1]
  const conversationToSummarize = history
    .slice(1)
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  try {
    const response = await fetch(currentProvider.url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${currentProvider.key}` 
      },
      body: JSON.stringify({
        model: currentProvider.model,
        messages: [
          { role: 'system', content: 'Résume la conversation suivante en 3 à 5 phrases max, en gardant les faits importants.' },
          { role: 'user', content: conversationToSummarize }
        ],
        temperature: 0.3 // Température basse pour un résumé factuel[cite: 1]
      })
    });

    const data = await response.json();
    const summary = data.choices[0].message.content;

    // Splice : on garde le system prompt [0] et on remplace tout le reste par le résumé[cite: 1]
    history.splice(1, history.length - 1, { 
      role: 'system', 
      content: `Résumé de la discussion précédente : ${summary}` 
    });

    console.log('[Système] ✅ Historique compressé.\n');
  } catch (error) {
    console.error('[Erreur Compression]', error.message);
  }
}

// ---  COMMUNICATION AVEC IA (Phase 3 - Streaming) ---
async function chatStream(userMessage) {
  // Vérification de la compression AVANT l'appel[cite: 1]
  await compressHistory();

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
      stream: true // Activation du streaming[cite: 1]
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
          process.stdout.write(delta); // Affichage sans saut de ligne[cite: 1]
          fullContent += delta;
        }
      } catch (e) {}
    }
  }

  process.stdout.write('\n\n');
  history.push({ role: 'assistant', content: fullContent });
}

// ---  BOUCLE PRINCIPALE (Phase 1 & 4) ---
async function main() {
  console.log('--- Chatbot CLI Phase 6 Connecté ---');
  console.log('Commandes : /provider <mistral|groq>, /history, /resume, exit\n');

  while (true) {
    const input = await question('Vous : ');

    if (input.toLowerCase() === 'exit') break;

    if (input === '/resume') {
      await generateResume();
      continue;
    }

    // Gestion de la commande /provider (Phase 4)[cite: 1]
    if (input.startsWith('/provider')) {
      const name = input.split(' ')[1];
      if (PROVIDERS[name]) {
        currentProvider = PROVIDERS[name];
        console.log(`✅ Provider changé pour : ${name}\n`);
      } else {
        console.log(`❌ Inconnu. Providers : mistral, groq\n`);
      }
      continue; // Retour au début de la boucle
    }

    // Gestion de la commande /history (Phase 2)[cite: 1]
    if (input === '/history') {
      console.log('\n--- État actuel de history[] ---');
      history.forEach((m, i) => {
        console.log(`${i}. [${m.role.padEnd(9)}] ${m.content.substring(0, 70)}...`);
      });
      console.log('--------------------------------\n');
      continue;
    }

    // Appel normal de l'IA (Phase 3)
    try {
      await chatStream(input);
    } catch (err) {
      console.error('\n⚠️ Erreur lors de l\'appel API.');
    }
  }
  rl.close();
}

main();