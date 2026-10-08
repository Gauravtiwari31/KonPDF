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

# Google ML Kit (Scan tab: document scanner, text reader). ML Kit finds its
# parts at runtime through a component registry; R8 strips or merges pieces it
# can't see being used, and GmsDocumentScanning.getClient / TextRecognition
# .getClient then fail with a NullPointerException deep inside ML Kit (seen on
# a TECNO LJ8, Android 16). Keep ML Kit and the registry intact.
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.internal.mlkit_** { *; }
-keep class com.google.firebase.components.** { *; }
-keep class com.google.android.odml.image.** { *; }
