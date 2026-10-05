const earthRotation = 7.292115e-5;
const c = 299792.458;
export function dopplerFactor(observerCoordsEcf, positionEcf, velocityEcf) {
    const rangeX = positionEcf.x - observerCoordsEcf.x;
    const rangeY = positionEcf.y - observerCoordsEcf.y;
    const rangeZ = positionEcf.z - observerCoordsEcf.z;
    const length = Math.sqrt(rangeX ** 2 + rangeY ** 2 + rangeZ ** 2);
    const rangeVel = {
        x: velocityEcf.x + earthRotation * observerCoordsEcf.y,
        y: velocityEcf.y - earthRotation * observerCoordsEcf.x,
        z: velocityEcf.z
    };
    const rangeRate = (rangeX * rangeVel.x + rangeY * rangeVel.y + rangeZ * rangeVel.z) / length;
    return 1 - rangeRate / c;
}
