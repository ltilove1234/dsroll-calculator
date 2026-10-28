# 동서산업롤 계산기 (안드로이드 앱)

회사 엑셀 `계산기.xlsx`의 수식을 그대로 옮긴 안드로이드 앱입니다. 인터넷 없이 동작합니다.

- 시작 화면: 회사 마크, 시작하기, 재질·비중 관리
- 계산기 (옆으로 넘기기): 실중량 · 고무롤 견적 · 홈(그루브) 가공 · 간편 계산(RPM·내경)
- 각 계산기마다 1~5번 칸에 따로 계산 가능
- 재질·비중은 관리 화면에서 저장 (휴대폰에 보관)

## APK 만드는 법 ① — GitHub (설치 없이, 추천)

1. github.com 에 로그인 → 오른쪽 위 **+** → **New repository** → 이름 `dsroll-calculator` → **Create repository**
2. 새 저장소 화면에서 **uploading an existing file** 클릭
3. 이 압축을 푼 폴더 **안의 내용 전부**를 끌어다 놓기 (`.github` 폴더 포함) → **Commit changes**
   - `.github` 폴더가 안 보이면 윈도우 탐색기 › 보기 › 숨긴 항목 체크
4. 저장소 위쪽 **Actions** 탭에서 "APK 만들기"가 초록 체크가 될 때까지 3~5분 기다리기
5. 저장소 오른쪽 **Releases** → `dsroll-calculator.apk` 내려받기

## APK 만드는 법 ② — Android Studio

1. Android Studio 설치 후 **Open** → 이 폴더 선택 (처음엔 준비에 몇 분 걸림)
2. 메뉴 **Build › Build App Bundle(s) / APK(s) › Build APK(s)**
3. 완료 알림의 **locate** → `app-debug.apk`

## 휴대폰에 설치

APK 파일을 휴대폰으로 옮겨(카톡·메일·USB) 누르면 설치됩니다.
"출처를 알 수 없는 앱" 허용을 물으면 허용해 주세요.

## 화면 고치기

화면과 계산은 `app/src/main/assets/www/` 안의 `index.html`, `style.css`, `app.js` 에 있습니다.
수정 후 GitHub에 다시 올리면 새 APK가 자동으로 만들어집니다.
