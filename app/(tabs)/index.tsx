// App.tsx
import Slider from "@react-native-community/slider";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import React, { useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

// ====== Dados: MAP/REVERSE ======
const MAP: Record<string, string> = {
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
  "0": "-----",
  "1": ".----",
  "2": "..---",
  "3": "...--",
  "4": "....-",
  "5": ".....",
  "6": "-....",
  "7": "--...",
  "8": "---..",
  "9": "----.",
  ".": ".-.-.-",
  ",": "--..--",
  "?": "..--..",
  "'": ".----.",
  "!": "-.-.--",
  "/": "-..-.",
  "(": "-.--.",
  ")": "-.--.-",
  "&": ".-...",
  ":": "---...",
  ";": "-.-.-.",
  "=": "-...-",
  "+": ".-.-.",
  "-": "-....-",
  _: "..--.-",
  '"': ".-..-.",
  $: "...-..-",
  "@": ".--.-.",
  Á: ".--.-",
  Ä: ".-.-",
  É: "..-..",
  Ñ: "--.--",
  Ö: "---.",
  Ü: "..--",
};

const REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(MAP).map(([k, v]) => [v, k])
);

// ====== Utils ======
const normalizeText = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

const normalizeMorse = (s: string) =>
  s
    .replace(/[•·]/g, ".")
    .replace(/[—–]/g, "-")
    .replace(/[|]+/g, "/")
    .replace(/\s*\/\s*/g, " / ")
    .replace(/[^\.\-\/\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function textToMorse(str: string) {
  const clean = normalizeText(str);
  return clean
    .split(/\s+/)
    .map((w) =>
      w
        .split("")
        .map((ch) => MAP[ch] || "")
        .filter(Boolean)
        .join(" ")
    )
    .filter(Boolean)
    .join(" / ");
}

function morseToText(code: string) {
  const norm = normalizeMorse(code);
  if (!norm) return "";
  return norm
    .split(/\s*\/\s*/)
    .map((w) =>
      w
        .trim()
        .split(/\s+/)
        .map((seq) => REVERSE[seq] || "�")
        .join("")
    )
    .join(" ");
}

// ====== Tempo / Tokens ======
const unitFromWPM = (wpm: number) => 2000 / wpm; // ms
type Token = { on: number; off: number } | { gap: number };

const seqToTokens = (seq: string): Token[] => {
  const tokens: Token[] = [];
  for (const ch of seq) {
    if (ch === ".") tokens.push({ on: 1, off: 1 });
    else if (ch === "-") tokens.push({ on: 3, off: 1 });
    else if (ch === " ") tokens.push({ gap: 2 });
    else if (ch === "/") tokens.push({ gap: 6 });
  }
  return tokens;
};

export default function App() {
  useKeepAwake();

  // ====== Estado UI ======
  const [plain, setPlain] = useState("");
  const [morse, setMorse] = useState("");
  const [wpm, setWpm] = useState(18);
  const [freq, setFreq] = useState(600); // placeholder p/ futuro áudio gerado por síntese
  const [vol, setVol] = useState(0.3);

  // LED de saída (player) e LED da “chave”
  const [ledOut, setLedOut] = useState(false);
  const [keyLed, setKeyLed] = useState(false);
  const [keyState, setKeyState] = useState<"Solto" | "Transmitindo">("Solto");

  // Captura (manipulador)
  const [captureSeq, setCaptureSeq] = useState("");
  const captureText = useMemo(
    () => (captureSeq.trim() ? morseToText(captureSeq.trim()) : "(vazio)"),
    [captureSeq]
  );

  // Timers de detecção de letra/palavra
  const letterTimer = useRef<NodeJS.Timeout | null>(null);
  const wordTimer = useRef<NodeJS.Timeout | null>(null);

  const keyDownAt = useRef<number>(0);
  const playingRef = useRef(false);
  const abortRef = useRef(false);

  // ====== Players de áudio (expo-audio) ======
  // Caminhos partindo de app/(tabs)/index.tsx -> ../../assets
  const playerDot = useAudioPlayer(require("../../assets/dot.wav"));
  const playerDash = useAudioPlayer(require("../../assets/dash.wav"));

  // ====== Helpers ======
  async function tone(on: boolean, isDash?: boolean) {
    setLedOut(on);
    if (!on) return;

    // haptics opcional
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // reinicia e toca o sample correto
    const p = isDash ? playerDash : playerDot;
    // alguns players ainda podem estar inicializando; usa optional chaining
    p?.seekTo?.(0);
    p?.play?.();
  }

  function stopPlayback() {
    abortRef.current = true;
  }

  async function playSeq(seq?: string) {
    const normalized = normalizeMorse(seq || "");
    if (!normalized) return;
    const unit = unitFromWPM(wpm);
    const tokens = seqToTokens(normalized + " ");
    abortRef.current = false;
    playingRef.current = true;

    try {
      for (const tk of tokens) {
        if (abortRef.current) break;
        if ("on" in tk) {
          await tone(true, tk.on === 3);
          await waitMs(tk.on * unit);
          await tone(false);
          await waitMs(tk.off * unit);
        } else {
          await waitMs(tk.gap * unit);
        }
      }
    } finally {
      playingRef.current = false;
      abortRef.current = false;
      setLedOut(false);
    }
  }

  // ====== Conversor UI ======
  const handleToMorse = () => setMorse(textToMorse(plain));
  const handleToText = () => {
    const norm = normalizeMorse(morse);
    setMorse(norm);
    setPlain(morseToText(norm));
  };

  // ====== Manipulador (chave) ======
  const startKey = () => {
    if (playingRef.current) stopPlayback();
    setKeyLed(true);
    setKeyState("Transmitindo");
    keyDownAt.current = Date.now();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const stopKey = () => {
    setKeyLed(false);
    setKeyState("Solto");
    const press = Date.now() - keyDownAt.current;
    const u = unitFromWPM(wpm);
    const dotDashThreshold = 2.2 * u; // mesmo default do web
    const symbol = press < dotDashThreshold ? "." : "-";
    setCaptureSeq((prev) => prev + symbol);
    scheduleGapDetection();
  };

  function scheduleGapDetection() {
    if (letterTimer.current) clearTimeout(letterTimer.current);
    if (wordTimer.current) clearTimeout(wordTimer.current);
    // Mantém 1.5s/3.5s fixos (pode virar slider no futuro)
    letterTimer.current = setTimeout(() => {
      setCaptureSeq((prev) => {
        if (!prev.trim()) return prev;
        if (!/\s$/.test(prev) && !/\s\/\s$/.test(prev)) return prev + " ";
        return prev;
      });
    }, 1500);
    wordTimer.current = setTimeout(() => {
      setCaptureSeq((prev) => {
        if (/\s\/\s$/.test(prev)) return prev;
        if (/\s$/.test(prev)) return prev.replace(/\s+$/, " / ");
        return prev + " / ";
      });
    }, 3500);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0b1020", top: 50 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 16 : 0}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {/* Conteúdo */}
          <Text style={s.h1}>Telégrafo em Código Morse</Text>
          <Text style={s.h1}>By: Patriky Brito</Text>

          {/* Conversor */}
          <View style={s.card}>
            <Text style={s.hd}>Conversor</Text>

            <Text style={s.label}>Texto</Text>
            <TextInput
              style={s.textarea}
              multiline
              scrollEnabled={false}
              textAlignVertical="top"
              placeholder="Ex.: S.O.S precisamos de ajuda!"
              value={plain}
              onChangeText={setPlain}
            />

            <View style={s.row}>
              <Pressable style={[s.button, s.primary]} onPress={handleToMorse}>
                <Text style={s.buttonText}>Codificar → Morse</Text>
              </Pressable>
              <Pressable style={s.button} onPress={() => setPlain("")}>
                <Text style={s.buttonText}>Limpar</Text>
              </Pressable>
            </View>

            <Text style={[s.label, { marginTop: 12 }]}>Morse</Text>
            <TextInput
              style={s.textarea}
              multiline
              scrollEnabled={false}
              textAlignVertical="top"
              placeholder="Ex.: ... --- ... / .--."
              value={morse}
              onChangeText={setMorse}
            />

            <View style={s.row}>
              <Pressable style={[s.button, s.primary]} onPress={handleToText}>
                <Text style={s.buttonText}>Decodificar → Texto</Text>
              </Pressable>
              <Pressable style={s.button} onPress={() => setMorse("")}>
                <Text style={s.buttonText}>Limpar</Text>
              </Pressable>
            </View>

            <View style={[s.row, { alignItems: "center", marginTop: 12 }]}>
              <Pressable
                style={s.button}
                onPress={() => playSeq(morse || textToMorse(plain))}
              >
                <Text style={s.buttonText}>▶ Reproduzir (LED/Haptics)</Text>
              </Pressable>
              <Pressable style={s.button} onPress={stopPlayback}>
                <Text style={s.buttonText}>⏹ Parar</Text>
              </Pressable>
              <View style={s.ledWrap}>
                <Text style={s.small}>LED</Text>
                <View style={[s.led, ledOut && s.ledOn]} />
              </View>
            </View>

            {/* Sliders */}
            <View style={{ marginTop: 12 }}>
              <Text style={s.small}>WPM: {wpm}</Text>
              <Slider
                minimumValue={5}
                maximumValue={40}
                value={wpm}
                onValueChange={(v) => setWpm(Math.round(v))}
              />
              <Text style={s.small}>Frequência (Hz): {freq}</Text>
              <Slider
                minimumValue={200}
                maximumValue={1200}
                value={freq}
                onValueChange={(v) => setFreq(Math.round(v))}
              />
              <Text style={s.small}>Volume: {vol.toFixed(2)}</Text>
              <Slider
                minimumValue={0}
                maximumValue={1}
                step={0.01}
                value={vol}
                onValueChange={(v) => setVol(v)}
              />
            </View>
          </View>

          {/* Manipulador */}
          <View style={s.card}>
            <Text style={s.hd}>Manipulador</Text>

            <Pressable
              onPressIn={startKey}
              onPressOut={stopKey}
              style={({ pressed }) => [s.key, pressed && s.keyActive]}
            >
              <View style={{ alignItems: "center" }}>
                <View style={[s.led, keyLed && s.ledOn, { marginBottom: 8 }]} />
                <Text style={s.mono}>{keyState}</Text>
                <Text style={s.small}>
                  Segure para emitir; o app detecta ponto/traço pelo tempo.
                </Text>
              </View>
            </Pressable>

            <View style={{ marginTop: 12 }}>
              <Text style={s.small}>Sinal capturado</Text>
              <View style={s.output}>
                <Text style={s.mono}>{captureSeq.trim() || "(vazio)"}</Text>
              </View>
            </View>
            <View style={{ marginTop: 12 }}>
              <Text style={s.small}>Texto decodificado</Text>
              <View style={s.output}>
                <Text>{captureText}</Text>
              </View>
            </View>

            <View style={[s.row, { marginTop: 12 }]}>
              <Pressable style={s.button} onPress={() => setCaptureSeq("")}>
                <Text style={s.buttonText}>Limpar captura</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function waitMs(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const s = StyleSheet.create({
  scroll: { padding: 12, paddingBottom: 24, backgroundColor: "#0b1020" },
  h1: { color: "#e9eefc", fontSize: 20, fontWeight: "800", marginBottom: 12 },
  card: {
    backgroundColor: "#121a33",
    borderColor: "#243058",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  hd: { color: "#e9eefc", fontWeight: "700", marginBottom: 8 },
  label: { color: "#9bb1e7", fontSize: 12, marginBottom: 6 },
  textarea: {
    minHeight: 84,
    backgroundColor: "#fff",
    color: "#000",
    borderColor: "#1f2a53",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    fontFamily: "Courier",
  },
  row: { flexDirection: "row", gap: 8, marginTop: 8 },
  button: {
    backgroundColor: "#0e1530",
    borderColor: "#2a355f",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  primary: { backgroundColor: "#121f58", borderColor: "#3851c7" },
  buttonText: { color: "#e9eefc", fontWeight: "700" },
  small: { color: "#7f8dab", fontSize: 12 },
  mono: { fontFamily: "Courier", color: "#000" },
  ledWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  led: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#193b41",
    backgroundColor: "#0a1f22",
  },
  ledOn: { backgroundColor: "#7affd1" },
  key: {
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#2a355f",
    borderRadius: 18,
    padding: 30,
    alignItems: "center",
    backgroundColor: "#0e1530",
  },
  keyActive: {
    borderStyle: "solid",
    backgroundColor: "#14274e",
  },
  output: {
    minHeight: 64,
    backgroundColor: "#fff",
    borderColor: "#223060",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
});
