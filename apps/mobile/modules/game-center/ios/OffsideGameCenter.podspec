Pod::Spec.new do |s|
  s.name = 'OffsideGameCenter'
  s.version = '1.0.0'
  s.summary = 'OFFSIDE GameKit integration'
  s.description = 'Game Center authentication, records and dashboard for OFFSIDE.'
  s.license = { :type => 'UNLICENSED' }
  s.author = 'OFFSIDE'
  s.homepage = 'https://offside-lab.com'
  s.source = { :git => 'https://github.com/tasddc1226/offside-football-simulator.git' }
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'GameKit'
  s.source_files = '**/*.swift'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
