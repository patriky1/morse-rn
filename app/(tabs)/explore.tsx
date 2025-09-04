// app/(tabs)/explore.tsx
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { MORSE_TABLE, prettyMorse } from "@/lib/morse";

export default function TabTwoScreen() {
  const [justCopied, setJustCopied] = useState<string | null>(null);

  async function copy(code: string) {
    await Clipboard.setStringAsync(code);
    Haptics.selectionAsync();
    setJustCopied(code);
    setTimeout(() => setJustCopied(null), 1200);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.headerRow}>
        <ThemedText type="title" style={styles.title}>
          Tabela de Referência
        </ThemedText>
        
      </View>

      <FlatList
        data={MORSE_TABLE}
        keyExtractor={(item) => item.char}
        numColumns={3}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => copy(item.code)}
            style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
          >
            <Text style={styles.ch}>{item.char}</Text>
            <Text style={styles.seq}>{prettyMorse(item.code)}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0b1020",
    paddingHorizontal: 12,
    paddingBottom: -50,
    paddingTop: 15,
  },
  headerRow: {
    
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    justifyContent:"center"
  },
  title: { color: "#e9eefc" },
  hint: { color: "#9bb1e7", fontSize: 12 },
  content: { paddingBottom: 8 },
  gridRow: { gap: 8, marginBottom: 8 },
  cell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "#0e1530",
    borderColor: "#2a355f",
  },
  cellPressed: { backgroundColor: "#14274e" },
  ch: { color: "#e9eefc", fontSize: 16, fontWeight: "700" },
  seq: {
    color: "#9bb1e7",
    fontFamily: "Courier",
    letterSpacing: 1,
  },
});
