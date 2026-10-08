package com.konpdf.scan

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.konpdf.model.ModelModule

/** Registers the Scan tab's modules, [ScanModule] and [ModelModule] (see MainApplication). */
class FeaturesPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
      when (name) {
        ScanModule.NAME -> ScanModule(reactContext)
        ModelModule.NAME -> ModelModule(reactContext)
        else -> null
      }

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    listOf(ScanModule.NAME, ModelModule.NAME).associateWith { name ->
      ReactModuleInfo(
          name = name,
          className = name,
          canOverrideExistingModule = false,
          needsEagerInit = false,
          isCxxModule = false,
          isTurboModule = true,
      )
    }
  }
}
