export const generateOrderNumber = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `GU-${timestamp}-${random}`;
}

export const generateTransactionId = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 9).toUpperCase();
    return `TXN-${timestamp}-${random}`;
}
