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


/**
 * Returns true if the view is being used to view a paste. Returns false
 * if the view is being used to create a paste.
 */
const isViewingPaste = () => {
    return new URL(window.location.href).searchParams.has("id");
}

const main = () => {
    console.log("Got here");
    if (isViewingPaste()) {
        console.log("Got here");
        const pasteTextArea = document.getElementsByTagName("textarea")[0];
        pasteTextArea.value = getPasteText();
        pasteTextArea.disabled = true;
    }
}

main();