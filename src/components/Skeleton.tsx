import React from "react";
import { View, ViewProps } from "react-native";

interface SkeletonProps extends ViewProps {
  className?: string;
}

/**
 * Reusable loading skeleton placeholder.
 * Animates opacity automatically using Tailwind's animate-pulse.
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className = "", ...props }) => {
  return (
    <View
      className={`bg-muted/80 rounded-md animate-pulse ${className}`}
      {...props}
    />
  );
};

export default Skeleton;
