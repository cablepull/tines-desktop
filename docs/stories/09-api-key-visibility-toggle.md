# User Story: API Key Visibility Toggle

## Description
**As an** end user logging into the application  
**I want to** toggle the visibility of my API Key / Token input field  
**So that** I can securely store or screenshot my screen without exposing the key, while retaining the ability to verify my key structure if I make a typo!

## Acceptance Criteria
- [x] Integrate standard `useState` to track whether the password field is in 'hidden' (`password`) or 'shown' (`text`) mode.
- [x] Add a simple "SHOW"/"HIDE" button seamlessly injected directly inside the input field.
- [x] Adjust input paddings to ensure long keys do not overlap visually with the text toggle button.
