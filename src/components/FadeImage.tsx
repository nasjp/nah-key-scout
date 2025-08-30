"use client";

import Image, { type ImageProps } from "next/image";
import { type SyntheticEvent, useCallback, useState } from "react";

type Props = Omit<ImageProps, "onLoadingComplete"> & {
  fadeDurationMs?: number;
};

export default function FadeImage({
  className,
  style,
  fadeDurationMs = 300,
  onLoad,
  ...rest
}: Props) {
  const [loaded, setLoaded] = useState(false);

  const handleLoad = useCallback(
    (e: SyntheticEvent<HTMLImageElement>) => {
      setLoaded(true);
      onLoad?.(e);
    },
    [onLoad],
  );

  const transitionClass = `transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`;
  const cls = className ? `${className} ${transitionClass}` : transitionClass;
  const mergedStyle = {
    ...style,
    transitionDuration: `${fadeDurationMs}ms`,
  } as const;

  return (
    <Image className={cls} style={mergedStyle} onLoad={handleLoad} {...rest} />
  );
}
