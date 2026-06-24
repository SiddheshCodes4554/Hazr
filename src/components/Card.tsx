import React from "react";
import { View, ViewProps, Text, TextProps } from "react-native";

interface CardProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Premium container card utilizing a subtle border, background transparency,
 * and elevation shadows suited for light and dark environments.
 */
export const Card: React.FC<CardProps> = ({ children, className = "", ...props }) => {
  return (
    <View
      className={`bg-card/85 border border-border/60 rounded-2xl p-4 shadow-sm shadow-black/5 ${className}`}
      {...props}
    >
      {children}
    </View>
  );
};

export const CardHeader: React.FC<CardProps> = ({ children, className = "", ...props }) => {
  return (
    <View className={`mb-3 flex-col ${className}`} {...props}>
      {children}
    </View>
  );
};

export const CardTitle: React.FC<TextProps> = ({ children, className = "", ...props }) => {
  return (
    <Text className={`text-foreground font-bold text-base ${className}`} {...props}>
      {children}
    </Text>
  );
};

export const CardDescription: React.FC<TextProps> = ({ children, className = "", ...props }) => {
  return (
    <Text className={`text-muted-foreground text-xs mt-0.5 font-medium ${className}`} {...props}>
      {children}
    </Text>
  );
};

export const CardContent: React.FC<CardProps> = ({ children, className = "", ...props }) => {
  return (
    <View className={`flex-col ${className}`} {...props}>
      {children}
    </View>
  );
};

export const CardFooter: React.FC<CardProps> = ({ children, className = "", ...props }) => {
  return (
    <View
      className={`mt-4 pt-3.5 border-t border-border/40 flex-row justify-end items-center ${className}`}
      {...props}
    >
      {children}
    </View>
  );
};

export default Card;
