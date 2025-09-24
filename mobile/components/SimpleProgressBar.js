import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const SimpleProgressBar = ({ progress = 0, height = 8, color = '#4CAF50', backgroundColor = '#E0E0E0' }) => {
  const safeProgress = Math.max(0, Math.min(100, progress || 0));
  
  return (
    <View style={[styles.container, { height, backgroundColor }]}>
      <View 
        style={[
          styles.progress, 
          { 
            width: `${safeProgress}%`,
            backgroundColor: color,
            height: height - 2
          }
        ]} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: 4,
  },
  progress: {
    borderRadius: 4,
  },
});

export default SimpleProgressBar;
