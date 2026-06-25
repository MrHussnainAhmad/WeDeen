import React, { useState, useEffect } from 'react';
import { Alert, Modal, StyleSheet, Text, View, Pressable, Platform, AlertButton } from 'react-native';
import { colors, fonts, radius, shadow } from '@/theme/colors';

type AlertConfig = {
  title: string;
  message?: string;
  buttons?: AlertButton[];
};

export function CustomAlertProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AlertConfig | null>(null);

  useEffect(() => {
    const originalAlert = Alert.alert;
    Alert.alert = (
      title: string,
      message?: string,
      buttons?: AlertButton[],
      options?: any
    ) => {
      const alertButtons = buttons || [{ text: 'OK' }];
      setConfig({ title, message, buttons: alertButtons });
    };

    return () => {
      Alert.alert = originalAlert;
    };
  }, []);

  const handleClose = () => {
    setConfig(null);
  };

  return (
    <>
      {children}
      <Modal
        visible={!!config}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View style={styles.overlay}>
          <View style={styles.modalContent}>
            <Text style={styles.title}>{config?.title}</Text>
            {config?.message ? <Text style={styles.message}>{config.message}</Text> : null}
            
            <View style={styles.buttonsContainer}>
              {config?.buttons?.map((btn, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => {
                    handleClose();
                    if (btn.onPress) btn.onPress();
                  }}
                  style={[
                    styles.button,
                    btn.style === 'destructive' ? styles.destructiveButton :
                    btn.style === 'cancel' ? styles.cancelButton : styles.defaultButton,
                    config.buttons?.length === 2 && styles.buttonHalf
                  ]}
                >
                  <Text style={[
                    styles.buttonText,
                    btn.style === 'destructive' ? styles.destructiveText :
                    btn.style === 'cancel' ? styles.cancelText : styles.defaultText
                  ]}>
                    {btn.text || 'OK'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#ffffff',
    borderRadius: radius.lg,
    padding: 24,
    ...shadow.raised,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primaryDeep,
    fontFamily: fonts.serif,
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 14.5,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  buttonHalf: {
    flex: 1,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  defaultButton: {
    backgroundColor: colors.primary,
    ...shadow.soft,
  },
  cancelButton: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  destructiveButton: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: '#E8B4AB',
  },
  buttonText: {
    fontWeight: '800',
    fontSize: 14,
  },
  defaultText: {
    color: '#ffffff',
  },
  cancelText: {
    color: colors.muted,
  },
  destructiveText: {
    color: colors.danger,
  },
});
