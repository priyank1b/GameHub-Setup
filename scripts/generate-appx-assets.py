import os
from PIL import Image

def generate_appx_assets():
    workspace = r'e:\AI_software\GameDirectory'
    src_icon_path = os.path.join(workspace, 'assets', 'icon.png')
    
    if not os.path.exists(src_icon_path):
        raise FileNotFoundError(f"Source icon not found at {src_icon_path}")

    icon = Image.open(src_icon_path).convert('RGBA')
    bg_color = (13, 15, 18, 255) # #0d0f12 brand dark background

    # Target directories
    dirs = [
        os.path.join(workspace, 'assets', 'appx'),
        os.path.join(workspace, 'build', 'appx'),
    ]

    for d in dirs:
        os.makedirs(d, exist_ok=True)

    # Asset definitions:
    # 1. StoreLogo.png: 50x50
    store_logo = icon.resize((50, 50), Image.Resampling.LANCZOS)

    # 2. Square44x44Logo.png: 44x44
    sq44 = icon.resize((44, 44), Image.Resampling.LANCZOS)

    # 3. Square150x150Logo.png: 150x150
    sq150 = icon.resize((150, 150), Image.Resampling.LANCZOS)

    # 4. SmallTile.png: 71x71
    sq71 = icon.resize((71, 71), Image.Resampling.LANCZOS)

    # 5. LargeTile.png: 310x310
    sq310 = icon.resize((310, 310), Image.Resampling.LANCZOS)

    # 6. Wide310x150Logo.png: 310x150
    wide = Image.new('RGBA', (310, 150), bg_color)
    icon_wide = icon.resize((130, 130), Image.Resampling.LANCZOS)
    wide.paste(icon_wide, ((310 - 130) // 2, (150 - 130) // 2), icon_wide)

    # 7. SplashScreen.png: 620x300
    splash = Image.new('RGBA', (620, 300), bg_color)
    icon_splash = icon.resize((200, 200), Image.Resampling.LANCZOS)
    splash.paste(icon_splash, ((620 - 200) // 2, (300 - 200) // 2), icon_splash)

    # 8. BadgeLogo.png: 24x24
    badge = icon.resize((24, 24), Image.Resampling.LANCZOS)

    assets_map = {
        'StoreLogo.png': store_logo,
        'Square44x44Logo.png': sq44,
        'Square150x150Logo.png': sq150,
        'Wide310x150Logo.png': wide,
        'LargeTile.png': sq310,
        'SmallTile.png': sq71,
        'SplashScreen.png': splash,
        'BadgeLogo.png': badge,
    }

    for target_dir in dirs:
        for filename, img in assets_map.items():
            dest = os.path.join(target_dir, filename)
            img.save(dest, format='PNG')
            print(f"Generated: {dest} ({img.size})")

if __name__ == '__main__':
    generate_appx_assets()
    print("All AppX tile branding assets generated successfully.")
