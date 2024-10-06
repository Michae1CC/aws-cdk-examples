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

const setupViewingPaste = async () => {
    const pasteId = new URL(window.location.href).searchParams.get("id") ?? "";
    const getPasteResponse = await fetch("/api/get_paste", {
        method: "POST",
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ "id": pasteId })
    });
    const jsonResponse = await getPasteResponse.json();

    const pasteTextArea = document.getElementsByTagName("textarea")[0];
    pasteTextArea.disabled = true;
    pasteTextArea.value = jsonResponse.text;

    const shareButton = document.getElementsByTagName("button")[0];
    shareButton.onclick = onShareButtonCLick;
}

const main = () => {
    setupViewingPaste();
}

main();