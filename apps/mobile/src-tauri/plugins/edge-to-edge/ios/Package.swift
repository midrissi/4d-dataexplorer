// swift-tools-version:5.3

import PackageDescription

let package = Package(
  name: "tauri-plugin-edge-to-edge",
  platforms: [
    .iOS(.v13),
  ],
  products: [
    .library(
      name: "tauri-plugin-edge-to-edge",
      type: .static,
      targets: ["tauri-plugin-edge-to-edge"]
    )
  ],
  dependencies: [
    .package(name: "Tauri", path: "../.tauri/tauri-api")
  ],
  targets: [
    .target(
      name: "tauri-plugin-edge-to-edge",
      dependencies: [
        .byName(name: "Tauri")
      ],
      path: "Sources"
    )
  ]
)
