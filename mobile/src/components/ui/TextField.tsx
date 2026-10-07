import React, { forwardRef, ReactNode, useState } from 'react';
import {
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputInstance,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { fonts, useTheme } from '../../theme';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
  hint?: string;
  icon?: IconName;
  /** Element rendered inside the field on the right (e.g. show/hide toggle). */
  right?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Outlined input. Focus is shown the brutalist way: the field "lifts" onto a
 * hard shadow instead of changing colour subtly.
 */
export const TextField = forwardRef<TextInputInstance, TextFieldProps>(
  function TextFieldImpl(
    {
      label,
      error,
      hint,
      icon,
      right,
      containerStyle,
      style,
      onFocus,
      onBlur,
      multiline,
      ...rest
    },
    ref,
  ) {
    const t = useTheme();
    const [focused, setFocused] = useState(false);
    const borderColor = error ? t.colors.danger : t.colors.line;

    return (
      <View style={containerStyle}>
        {label ? (
          <AppText
            variant="label"
            color="textMuted"
            uppercase
            style={styles.label}
          >
            {label}
          </AppText>
        ) : null}
        <View style={styles.shadowSpace}>
          <View
            style={[
              styles.shadow,
              !focused && styles.hidden,
              {
                borderRadius: t.radius.md,
                backgroundColor: error ? t.colors.danger : t.colors.shadow,
              },
            ]}
          />
          <View
            style={[
              styles.field,
              multiline ? styles.fieldMultiline : styles.fieldSingle,
              {
                backgroundColor: t.colors.surface,
                borderColor,
                borderWidth: t.border,
                borderRadius: t.radius.md,
              },
            ]}
          >
            {icon ? (
              <View style={multiline ? styles.iconTop : undefined}>
                <Icon
                  name={icon}
                  size={19}
                  color={t.colors.textMuted}
                  strokeWidth={2.2}
                />
              </View>
            ) : null}
            <TextInput
              ref={ref}
              placeholderTextColor={t.colors.textFaint}
              selectionColor={t.colors.primary}
              cursorColor={t.colors.text}
              multiline={multiline}
              onFocus={e => {
                setFocused(true);
                onFocus?.(e);
              }}
              onBlur={e => {
                setFocused(false);
                onBlur?.(e);
              }}
              style={[
                styles.input,
                { color: t.colors.text, fontFamily: fonts.medium },
                multiline && styles.multiline,
                style,
              ]}
              {...rest}
            />
            {right}
          </View>
        </View>
        {error ? (
          <AppText variant="mono" color="danger" style={styles.message}>
            {error}
          </AppText>
        ) : hint ? (
          <AppText variant="mono" color="textFaint" style={styles.message}>
            {hint}
          </AppText>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  label: { marginBottom: 8 },
  shadowSpace: { paddingRight: 3, paddingBottom: 3 },
  shadow: { position: 'absolute', top: 3, left: 3, right: 0, bottom: 0 },
  hidden: { opacity: 0 },
  field: { flexDirection: 'row', paddingHorizontal: 14, gap: 10 },
  fieldSingle: { minHeight: 54, alignItems: 'center' },
  fieldMultiline: { minHeight: 96, alignItems: 'flex-start' },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
  multiline: { textAlignVertical: 'top', minHeight: 80 },
  iconTop: { paddingTop: 15 },
  message: { marginTop: 6 },
});
