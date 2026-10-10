import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';

/** Source-native design-system button: only transform micro-interactions. */
export function XFileButton({ className = '', ...props }: HTMLMotionProps<'button'>) {
  const reduced = useReducedMotion();
  return <motion.button type="button" className={`xfile-button ${className}`} whileHover={reduced || props.disabled ? {} : { scale: 1.02 }} whileTap={reduced || props.disabled ? {} : { scale: .98 }} transition={{ type: 'spring', duration: .22, bounce: .15 }} {...props} />;
}