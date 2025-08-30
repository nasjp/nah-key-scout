"use client";

import Image, { type ImageProps } from "next/image";
import {
  type SyntheticEvent,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

type Props = Omit<ImageProps, "onLoadingComplete"> & {
  fadeDurationMs?: number;
};

export default function FadeImage({
  className,
  style,
  fadeDurationMs = 700,
  onLoad,
  ...rest
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [instant, setInstant] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // 画像がキャッシュ済みで既にcompleteなら、初回描画前に即表示
  useLayoutEffect(() => {
    const el = imgRef.current;
    if (el?.complete) {
      setInstant(true);
      setLoaded(true);
    }
  }, []);

  const handleLoad = useCallback(
    (e: SyntheticEvent<HTMLImageElement>) => {
      setLoaded(true);
      onLoad?.(e);
    },
    [onLoad],
  );

  const transitionClass = `transition-opacity ease-out ${loaded ? "opacity-100" : "opacity-0"}`;
  const cls = className ? `${className} ${transitionClass}` : transitionClass;
  const mergedStyle = {
    ...style,
    transitionDuration: instant ? "0ms" : `${fadeDurationMs}ms`,
  } as const;

  return (
    <Image
      ref={imgRef}
      className={cls}
      style={mergedStyle}
      onLoad={handleLoad}
      {...rest}
    />
  );
}
