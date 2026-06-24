import React from "react";
import { Pressable, Text, ActivityIndicator, PressableProps } from "react-native";

interface ButtonProps extends PressableProps {
  label: string;
  variant?: "primary" | "secondary" | "outline" | "destructive" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Reusable, high-fidelity button component styled using TailwindCSS via NativeWind.
 * Handles press active states, sizing, disabling, and loading indicator triggers.
 */
export const Button: React.FC<ButtonProps> = ({
  label,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className = "",
  ...props
}) => {
  // Styles for different button styles
  const variantStyles = {
    primary: "bg-primary text-primary-foreground active:opacity-90",
    secondary: "bg-secondary text-secondary-foreground active:opacity-90",
    outline: "border border-border bg-transparent active:bg-muted/10",
    destructive: "bg-destructive text-destructive-foreground active:opacity-90",
    ghost: "bg-transparent active:bg-muted/20",
  };

  // Text colors corresponding to variants
  const textStyles = {
    primary: "text-primary-foreground font-semibold",
    secondary: "text-secondary-foreground font-semibold",
    outline: "text-foreground font-semibold",
    destructive: "text-destructive-foreground font-semibold",
    ghost: "text-foreground font-semibold",
  };

  // Sizing definitions
  const sizeStyles = {
    sm: "py-2 px-4 rounded-lg",
    md: "py-3.5 px-6 rounded-xl",
    lg: "py-4 px-8 rounded-2xl",
  };

  const textSizeStyles = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const isBtnDisabled = disabled || loading;
  
  // Resolve loader color
  const loaderColor = 
    variant === "outline" || variant === "ghost"
      ? undefined // defaults to native text color
      : "#ffffff";

  return (
    <Pressable
      disabled={isBtnDisabled}
      className={`flex-row justify-center items-center ${sizeStyles[size]} ${variantStyles[variant]} ${
        isBtnDisabled ? "opacity-40" : ""
      } ${className}`}
      {...props}
    >
      {loading && (
        <ActivityIndicator
          size="small"
          color={loaderColor}
          className="mr-2"
        />
      )}
      <Text className={`${textSizeStyles[size]} ${textStyles[variant]} text-center`}>
        {label}
      </Text>
    </Pressable>
  );
};

export default Button;
