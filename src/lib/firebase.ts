import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

function criarDb(): Firestore {
  if (typeof window === "undefined") return getFirestore(app);
  try {
    // Cache local (IndexedDB): ao recarregar, os dados aparecem na hora, sem esperar a rede.
    // Long polling: evita a espera de dezenas de segundos em redes com proxy/firewall que
    // bloqueiam o canal padrão (WebChannel).
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      experimentalForceLongPolling: true,
    });
  } catch {
    return getFirestore(app); // já inicializado (hot reload)
  }
}
export const db = criarDb();

/** Pergunta direto à API do Firestore o que está errado (banco inexistente, regras, API desativada). */
export async function diagnosticarFirestore(): Promise<string> {
  const { projectId, apiKey } = firebaseConfig;
  try {
    const r = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/projetos?pageSize=1&key=${apiKey}`,
    );
    if (r.ok) return "ok";
    if (r.status === 404) return "O banco Firestore ainda não foi criado neste projeto. Crie em Build → Firestore Database → Criar banco de dados, no console do Firebase.";
    if (r.status === 403) {
      const msg: string = (await r.json().catch(() => ({})))?.error?.message ?? "";
      return /has not been used|disabled/i.test(msg)
        ? "A API do Cloud Firestore está desativada neste projeto. Crie o banco em Build → Firestore Database no console do Firebase."
        : "O Firestore recusou o acesso. Ajuste as regras de segurança para liberar a coleção “projetos”.";
    }
    return `O Firestore respondeu com erro ${r.status}.`;
  } catch {
    return "Não foi possível alcançar o Firestore. Verifique a conexão com a internet ou bloqueios de rede (proxy/firewall).";
  }
}

/** Analytics só existe no navegador; carregado sob demanda. */
export async function initAnalytics() {
  if (typeof window === "undefined") return;
  const { getAnalytics, isSupported } = await import("firebase/analytics");
  if (await isSupported()) getAnalytics(app);
}
