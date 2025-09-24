import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import SimpleProgressBar from './SimpleProgressBar';

const ProgressTest = () => {
  const [progress, setProgress] = useState(0);

  const testProgress = () => {
    let current = 0;
    const interval = setInterval(() => {
      current += 10;
      setProgress(current);
      
      if (current >= 100) {
        clearInterval(interval);
        setTimeout(() => setProgress(0), 2000);
      }
    }, 200);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Progress Bar Test</Text>
      
      <SimpleProgressBar 
        progress={progress}
        height={12}
        color="#4CAF50"
        backgroundColor="#E0E0E0"
      />
      
      <Text style={styles.text}>{progress}%</Text>
      
      <TouchableOpacity style={styles.button} onPress={testProgress}>
        <Text style={styles.buttonText}>Test Progress</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 10,
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 6,
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});

export default ProgressTest;
