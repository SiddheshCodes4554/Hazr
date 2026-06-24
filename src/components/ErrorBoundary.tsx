import React, { Component, ErrorInfo, ReactNode } from "react";
import { View, Text, SafeAreaView } from "react-native";
import { Button } from "./Button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Class component acting as a React Error Boundary.
 * Catches JavaScript errors anywhere in the child component tree,
 * logs the exceptions, and displays a fallback crash recovery interface.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error details to an external logging service if available
    console.error("ErrorBoundary caught an uncaught exception:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <SafeAreaView className="flex-1 bg-background">
          <View className="flex-1 justify-center items-center px-6">
            <View className="items-center max-w-md w-full bg-card border border-border/50 rounded-3xl p-6 shadow-xl">
              <View className="w-14 h-14 bg-destructive/10 rounded-full justify-center items-center mb-4">
                <Text className="text-xl text-destructive font-bold">⚠️</Text>
              </View>
              
              <Text className="text-foreground text-lg font-bold text-center mb-1">
                Hazr Crashed Unexpectedly
              </Text>
              
              <Text className="text-muted-foreground text-xs text-center mb-5">
                We encountered an error during runtime. This report will help us resolve it.
              </Text>

              {this.state.error && (
                <View className="w-full bg-muted/50 rounded-xl p-3 mb-6 border border-border/30">
                  <Text className="text-destructive font-mono text-[10px] select-text">
                    {this.state.error.name}: {this.state.error.message}
                  </Text>
                </View>
              )}

              <Button
                label="Re-launch Application"
                variant="primary"
                className="w-full"
                onPress={this.handleReset}
              />
            </View>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
