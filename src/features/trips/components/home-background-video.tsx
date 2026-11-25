import { useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

// 15 s loop of European landmarks (Schönbrunn, Milan Duomo, Neuschwanstein, Schönbrunn gardens,
// Cologne Cathedral, St. Stephen's), cut from Pexels clips (free to use, no attribution needed).
// Bundled with the app, so it plays offline and starts instantly.
const backgroundVideo = require('@/assets/videos/home-background.mp4');

// The home screen's backdrop: the video fills the screen behind everything, muted and looping,
// with a dark layer on top so the cards and white text stay readable.
export function HomeBackgroundVideo() {
  const player = useVideoPlayer(backgroundVideo, (p) => {
    p.loop = true;
    p.muted = true;
  });
  // The tabs stay mounted when hidden, so play only while Home is the visible tab, and not at
  // all if the phone asks for reduced motion (it then shows the first frame).
  const isFocused = useIsFocused();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isFocused || reduceMotion) {
      player.pause();
      return;
    }
    player.play();
    // expo-video pauses when the app goes to the background but doesn't resume on return
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') player.play();
    });
    return () => subscription.remove();
  }, [isFocused, reduceMotion, player]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} className="bg-[#0E1724]">
      {/* Light status bar icons over the dark video; the root layout's style returns on blur */}
      {isFocused && <StatusBar style="light" />}
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
      <View style={StyleSheet.absoluteFill} className="bg-black/30" />
    </View>
  );
}
