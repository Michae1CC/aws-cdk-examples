export const handler = async (event) => {
    return {
        statusCode: 200,
        body: JSON.stringify([
            {
                id: 123456,
                name: "John Doe",
                email: "johndoe@example.com"
            },
            {
                id: 123457,
                name: "Ann Doe",
                email: "anndoe@example.com"
            }
        ]),
        headers: {
            "Content-Type": "application/json"
        },
    };
};

