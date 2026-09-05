import SwiftUI

@main
struct TellaVisionApp: App {
    var body: some Scene {
        WindowGroup {
            WebHost()
                .ignoresSafeArea()          // the web layer handles safe areas via env()
                .preferredColorScheme(.dark)
                .statusBarHidden(false)
        }
    }
}
