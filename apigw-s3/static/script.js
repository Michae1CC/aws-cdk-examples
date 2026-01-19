function onDeploy() {
    const deployButtonElement = document.getElementsByClassName("deploy-product")[0];
    console.log(deployButtonElement.value);
}

async function main() {
    const url = "/prod/api/users";
    const response = await fetch(url);
    const responseJson = await response.json();
    const apiResultElement = document.getElementsByClassName("api-result")[0];
    apiResultElement.innerHTML = JSON.stringify(responseJson, null, 2);
}
main()