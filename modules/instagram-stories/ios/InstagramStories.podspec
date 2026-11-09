Pod::Spec.new do |s|
  s.name           = 'InstagramStories'
  s.version        = '1.0.0'
  s.summary        = 'Pellix: kartı Instagram Story düzenleyicisinde doğrudan açar'
  s.description    = 'Görseli Instagram pano anahtarlarına yazıp instagram-stories:// adresini açan yerel modül.'
  s.author         = 'Pellix'
  s.homepage       = 'https://www.pellix.app'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
