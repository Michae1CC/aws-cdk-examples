/**
 * *****************************************************************************
 * Controls domain level logic.
 * *****************************************************************************
 */

const getPasteText = (id) => {
    return "Paste data";
}

/**
 * *****************************************************************************
 * Controls application level logic
 * *****************************************************************************
 */


const onShareButtonCLick = () => {
    navigator.clipboard.writeText(window.location.href);

    const messageBox = document.getElementsByClassName("message-box")[0];
    messageBox.style.display = 'block';
    messageBox.style.animation = 'none';
    messageBox.offsetHeight; /* trigger reflow */
    messageBox.style.animation = null;
}

const setupViewingPaste = () => {
    const pasteTextArea = document.getElementsByTagName("textarea")[0];
    pasteTextArea.value = getPasteText();
    pasteTextArea.disabled = true;

    const shareButton = document.getElementsByTagName("button")[0];
    shareButton.onclick = onShareButtonCLick;
}

const main = () => {
    setupViewingPaste();
}

main();