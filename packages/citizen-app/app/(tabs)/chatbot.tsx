import { useState, useEffect } from 'react';
import { StyleSheet, FlatList, KeyboardAvoidingView, Platform, View, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { TextInput, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Markdown from 'react-native-markdown-display';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import { BASE_URL } from '@/services/api';
import { getToken } from '@/services/auth-store';

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
};

export default function ChatbotScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: 'Hello! I am RakshaBot. I can help guide you on survival techniques, first-aid, and safety protocols during disasters. How can I help you stay safe today?',
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    return () => {
      // We don't auto-stop on [recording] changes since it causes race conditions
      // with stopRecording(). Only stop on actual component unmount.
    };
  }, []);

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return;
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    const currentRecording = recording;
    setRecording(null); // Clear state immediately to prevent double unloading
    setIsRecording(false);
    setLoading(true);
    
    try {
      try {
         await currentRecording.stopAndUnloadAsync();
      } catch (unloadErr) {
         console.log('Recording already stopped or unloaded:', unloadErr);
      }
      
      const uri = currentRecording.getURI();
      
      if (uri) {
        await sendAudioMessage(uri);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error('Failed to process recording', err);
      setLoading(false);
    }
  };

  const sendAudioMessage = async (uri: string) => {
    try {
      let latitude = null;
      let longitude = null;
      try {
        let { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          latitude = location.coords.latitude;
          longitude = location.coords.longitude;
        }
      } catch (locErr) {
        console.log("Location error", locErr);
      }

      const token = await getToken();
      const formData = new FormData();
      formData.append('audio', {
        uri,
        name: 'audio.m4a',
        type: 'audio/m4a',
      } as any);

      if (latitude !== null && longitude !== null) {
        formData.append('latitude', latitude.toString());
        formData.append('longitude', longitude.toString());
      }

      const response = await fetch(`${BASE_URL}/chat/audio`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success && data.data?.transcription && data.data?.reply) {
        // Add transcribed user text
        const userMsg: Message = {
          id: Date.now().toString(),
          text: data.data.transcription,
          sender: 'user',
          timestamp: new Date()
        };
        // Add bot reply
        const botMsg: Message = {
          id: (Date.now() + 1).toString(),
          text: data.data.reply,
          sender: 'bot',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, userMsg, botMsg]);
      } else {
        throw new Error("Failed to process audio");
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: "I couldn't process your voice message. Please try tying it or checking your connection.",
        sender: 'bot',
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      let latitude = null;
      let longitude = null;
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          let location = await Location.getCurrentPositionAsync({});
          latitude = location.coords.latitude;
          longitude = location.coords.longitude;
        }
      } catch (locErr) {
        console.log("Location error", locErr);
      }

      const token = await getToken();
      const response = await fetch(`${BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: userMsg.text, latitude, longitude })
      });

      const data = await response.json();

      if (data.success && data.data?.reply) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          text: data.data.reply,
          sender: 'bot',
          timestamp: new Date()
        }]);
      } else {
        throw new Error("Failed to get response");
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: "I'm having trouble connecting to the network right now. Stay safe and try again when signal improves.",
        sender: 'bot',
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';
    return (
      <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowBot]}>
        {!isUser && (
          <View style={styles.botAvatarContainer}>
            <Image 
              source={require('@/assets/images/rakshasetu.png')} 
              style={styles.botAvatarImage} 
            />
          </View>
        )}
        <View style={[
          styles.messageBubble, 
          isUser ? [styles.userBubble, { backgroundColor: '#1A73E8' }] : [styles.botBubble, { backgroundColor: '#FFFFFF' }]
        ]}>
          <Markdown 
            style={{
              body: { ...styles.messageText, color: isUser ? 'white' : '#11181C' },
              paragraph: { marginTop: 0, marginBottom: 0 }
            }}
            onLinkPress={(url) => {
              if (url.includes('rakshasetu://')) {
                router.push('/(tabs)/explore');
                return false; 
              }
              return true; 
            }}
          >
            {item.text}
          </Markdown>
        </View>
      </View>
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: '#F0F2F5' }]}>
      <Stack.Screen options={{ title: 'RakshaBot API' }} />
      
      <View style={[styles.header, { backgroundColor: '#FFFFFF', paddingTop: Math.max(insets.top + 10, 45) }]}>
          <TouchableOpacity 
            style={{ position: 'absolute', top: Math.max(insets.top + 8, 45), right: 16, zIndex: 10, padding: 4 }} 
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={28} color="#11181C" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
              <Image source={require('@/assets/images/rakshasetu.png')} style={styles.headerLogo} />
              <ThemedText style={styles.headerTitle} type="title" lightColor="#11181C" darkColor="#11181C">RakshaBot</ThemedText>
          </View>
          <ThemedText style={styles.headerSubtitle} lightColor="#687076" darkColor="#687076">Official Disaster Response AI</ThemedText>
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardView} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
        />

        <View style={[styles.inputContainer, { borderTopColor: colors.icon }]}>
          <View style={[styles.inputWrapper, { backgroundColor: '#FFFFFF' }]}>
            <TextInput
              style={[styles.input, { color: '#11181C' }]}
              value={inputText}
              onChangeText={setInputText}
              placeholder={isRecording ? "Listening..." : "Ask for survival tips, first aid..."}
              placeholderTextColor={isRecording ? "#E53935" : "#687076"}
              multiline
              editable={!isRecording && !loading}
            />

            {!inputText.trim() ? (
              <TouchableOpacity 
                style={[styles.sendButton, { backgroundColor: isRecording ? '#FFEBEE' : '#F0F2F5' }]} 
                onPress={isRecording ? stopRecording : startRecording}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#11181C" />
                ) : (
                  <Ionicons 
                    name={isRecording ? "stop" : "mic"} 
                    size={20} 
                    color={isRecording ? "#E53935" : "#11181C"} 
                  />
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[styles.sendButton, { backgroundColor: '#000000' }]} 
                onPress={sendMessage}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="arrow-up" size={20} color="white" />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingBottom: 20,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLogo: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 6,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  keyboardView: {
    flex: 1,
  },
  messageList: {
    padding: 16,
    paddingBottom: 24,
    gap: 16,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
    marginLeft: 40,
  },
  messageRowBot: {
    justifyContent: 'flex-start',
    marginRight: 40,
  },
  botAvatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  botAvatarImage: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  userBubble: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 4,
  },
  botBubble: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
  },
  inputContainer: {
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 12,
    backgroundColor: 'transparent',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(150,150,150,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    fontSize: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    marginBottom: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  }
});
