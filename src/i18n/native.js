import { Alert as NativeAlert } from 'react-native';
import { t } from './core';
export const Alert = {
  ...NativeAlert,
  alert(title, message, buttons, options) {
    return NativeAlert.alert(t(title), t(message), buttons?.map(button => ({ ...button, text: t(button.text) })), options);
  },
};
