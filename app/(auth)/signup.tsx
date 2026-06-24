import React, { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Alert } from "react-native";
import { router, Link } from "expo-router";
import { supabase } from "../../src/api/supabase";
import { Button } from "../../src/components/Button";
import { Input } from "../../src/components/Input";
import { Card } from "../../src/components/Card";

export default function SignupScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignup = async () => {
    if (!email || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpErr) throw signUpErr;

      // Supabase email verification might be active. Check if session was created:
      if (data.session) {
        router.replace("/(tabs)");
      } else {
        Alert.alert(
          "Registration Successful",
          "Please check your inbox to confirm your email verification link.",
          [{ text: "Go to Sign In", onPress: () => router.replace("/(auth)/login") }]
        );
      }
    } catch (err: any) {
      setError(err?.message || "An error occurred during registration");
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
              Create an account to report situational hazards
            </Text>
          </View>

          {/* Signup Card */}
          <Card className="w-full">
            <Text className="text-foreground text-xl font-bold mb-5 select-none">
              Get Started
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
              autoComplete="password-new"
              value={password}
              onChangeText={setPassword}
            />

            <Input
              label="Confirm Password"
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <Button
              label="Create Account"
              variant="primary"
              loading={loading}
              onPress={handleSignup}
              className="mt-2 w-full"
            />
          </Card>

          {/* Footer Link */}
          <View className="flex-row justify-center items-center mt-6">
            <Text className="text-muted-foreground text-sm font-medium select-none">
              Already have an account?{" "}
            </Text>
            <Link href="/(auth)/login" asChild>
              <Text className="text-primary text-sm font-bold active:opacity-70">
                Sign In
              </Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
