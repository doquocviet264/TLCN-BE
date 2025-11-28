export const passwordValidator = (value) => {
  const errors = [];

  if (value.length < 8) {
    errors.push("Mật khẩu phải có ít nhất 8 ký tự");
  }
  if (!/[a-z]/.test(value)) {
    errors.push("Mật khẩu phải chứa ít nhất 1 chữ thường");
  }
  if (!/[A-Z]/.test(value)) {
    errors.push("Mật khẩu phải chứa ít nhất 1 chữ hoa");
  }
  if (!/[0-9]/.test(value)) {
    errors.push("Mật khẩu phải chứa ít nhất 1 chữ số");
  }
  if (!/[!@#$%^&*(),.?\":{}|<>_\-+=~`[\]\\;/]/.test(value)) {
    errors.push("Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt");
  }

  if (errors.length > 0) {
    throw new Error(errors.join(", "));
  }

  return true;
};
