# R8 rules for KonPDF release builds, on top of those that React Native and the
# libraries ship themselves (consumer rules). Only add rules that something
# actually needs, with the reason next to them.

# react-native-screens: MainActivity installs RNScreensFragmentFactory so the
# app survives Android restoring it after the process was killed. The factory
# recognises screen fragments by their class name starting with
# "com.swmansion.rnscreens"; obfuscated names would slip past it and bring the
# restore crash back. Keep the names (unused classes can still be removed).
-keepnames class com.swmansion.rnscreens.** { *; }

# llama.rn (Developer Mode's AI reader): its C++ code calls back into these
# Java classes by name over JNI, so R8 must neither remove nor rename them.
-keep class com.rnllama.** { *; }
