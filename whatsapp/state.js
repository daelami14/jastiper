const userStates =
    new Map();

function getDefaultState() {

    return {
        qr: null,
        connected: false,
        phone: null,
        lastConnected: null,
        isStarting: false
    };

}

function getState(userId) {

    if (
        !userStates.has(userId)
    ) {
        userStates.set(
            userId,
            getDefaultState()
        );
    }

    return userStates.get(userId);

}

function setState(
    userId,
    nextState
) {

    userStates.set(
        userId,
        {
            ...getState(userId),
            ...nextState
        }
    );

    return userStates.get(userId);

}

function removeState(userId) {

    userStates.delete(userId);

}

module.exports = {
    getState,
    setState,
    removeState
};
