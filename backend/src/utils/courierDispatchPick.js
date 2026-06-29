const { deliveryTimestampMs } = require('./deliveryDateTime');

const pickBestCourierForOrder = (orderRow, couriers, maxActive) => {
    const list = Array.isArray(couriers) ? couriers : [];
    const limit = Number(maxActive) > 0 ? Number(maxActive) : 5;
    const orderMs = deliveryTimestampMs(orderRow);

    let best = null;
    let bestScore = null;

    for (let i = 0; i < list.length; i++) {
        const row = list[i];
        const delivering = Number(row.delivering_now || 0);
        if (delivering >= 1) {
            continue;
        }

        const active = Number(row.active_orders || 0);
        if (active >= limit) {
            continue;
        }

        let score;
        if (active === 0) {
            score = 0;
        } else if (orderMs && row.nearest_slot_ms) {
            score = Math.abs(orderMs - Number(row.nearest_slot_ms));
        } else {
            score = active * 86400000;
        }

        if (bestScore === null || score < bestScore) {
            bestScore = score;
            best = row;
        } else if (score === bestScore && best) {
            const bestActive = Number(best.active_orders || 0);
            if (active < bestActive) {
                best = row;
            }
        }
    }

    return best;
};

const attachNearestSlots = (couriers, assignments) => {
    const slotMap = {};
    const assignList = Array.isArray(assignments) ? assignments : [];

    for (let i = 0; i < assignList.length; i++) {
        const row = assignList[i];
        const cid = Number(row.courier_id);
        if (!Number.isFinite(cid) || cid <= 0) {
            continue;
        }
        const ms = deliveryTimestampMs(row);
        if (ms === null) {
            continue;
        }
        if (slotMap[cid] === undefined || ms < slotMap[cid]) {
            slotMap[cid] = ms;
        }
    }

    const result = [];
    const courierList = Array.isArray(couriers) ? couriers : [];
    for (let j = 0; j < courierList.length; j++) {
        const c = courierList[j];
        const id = Number(c.id);
        result.push({
            ...c,
            nearest_slot_ms: slotMap[id] !== undefined ? slotMap[id] : null
        });
    }

    return result;
};

module.exports = {
    pickBestCourierForOrder,
    attachNearestSlots
};
