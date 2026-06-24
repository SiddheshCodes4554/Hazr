import React, { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { router, Link } from "expo-router";
import { supabase } from "../../src/api/supabase";
import { Button } from "../../src/components/Button";
import { Input } from "../../src/components/Input";
import { Card } from "../../src/components/Card";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInErr) throw signInErr;
      
      // router.replace will be handled by the _layout redirect,
      // but we force redirect just in case.
      router.replace("/(tabs)");
    } catch (err: any) {
      setError(err?.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-background"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="w-full">
        <View className="flex-1 justify-center px-6 py-12">
          {/* Logo & Header */}
          <View className="items-center mb-8">
            <View className="w-16 h-16 bg-primary rounded-3xl justify-center items-center shadow-lg shadow-primary/30 mb-4 rotate-12">
              <Text className="text-white text-3xl font-extrabold -rotate-12">H</Text>
            </View>
            <Text className="text-foreground text-3xl font-black tracking-tight">
              Hazr
            </Text>
            <Text className="text-muted-foreground text-sm mt-1 text-center font-medium">
              Situational Awareness & Hazard Reporting
            </Text>
          </View>

          {/* Login Card */}
          <Card className="w-full">
            <Text className="text-foreground text-xl font-bold mb-5 select-none">
              Welcome back
            </Text>

            {error ? (
              <View className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 mb-4">
                <Text className="text-destructive text-xs font-semibold text-center">
                  {error}
                </Text>
              </View>
            ) : null}

            <Input
              label="Email Address"
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />

            <Input
              label="Password"
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
            />

            <Button
              label="Sign In"
              variant="primary"
              loading={loading}
              onPress={handleLogin}
              className="mt-2 w-full"
            />
          </Card>

          <View className="flex-row justify-center items-center mt-6">
            <Text className="text-muted-foreground text-sm font-medium select-none">
              {"Don't have an account? "}
            </Text>
            <Link href="/(auth)/signup" asChild>
              <Text className="text-primary text-sm font-bold active:opacity-70">
                Sign Up
              </Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
