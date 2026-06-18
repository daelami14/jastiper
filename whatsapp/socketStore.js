const sockets =
    new Map();

function setSocket(
    userId,
    socket
) {

    sockets.set(
        userId,
        socket
    );

}

function getSocket(userId) {

    return sockets.get(userId) || null;

}

function removeSocket(userId) {

    sockets.delete(userId);

}

module.exports = {
    setSocket,
    getSocket,
    removeSocket
};
