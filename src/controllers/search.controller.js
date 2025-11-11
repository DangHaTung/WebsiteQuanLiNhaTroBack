import Tenant from '../models/tenant.model.js';
import Room from '../models/room.model.js';
import Contract from '../models/contract.model.js';
import Bill from '../models/bill.model.js';
import Complaint from '../models/complaint.model.js';

export const globalSearch = async (req, res) => {
    try {
    const { keyword, type, page = 1, pageSize = 10, roomType, roomStatus } = req.query;
        if (!keyword) {
            return res.status(400).json({
                success: false,
                message: 'Keyword is required'
            });
        }

        // Chuẩn hóa page và pageSize
        const pageNum = Math.max(parseInt(page), 1);
        const sizeNum = Math.max(parseInt(pageSize), 1);

        // Tạo query cho từng loại
        const queries = {
            tenant: () => Tenant.find({
                $or: [
                    { fullName: { $regex: keyword, $options: 'i' } },
                    { phone: { $regex: keyword, $options: 'i' } },
                    { email: { $regex: keyword, $options: 'i' } }
                ]
            })
            .select('fullName phone email')
            .skip((pageNum - 1) * sizeNum)
            .limit(sizeNum),

            room: () => {
                // Tìm kiếm phòng theo keyword, loại và trạng thái
                const roomQuery = {};
                if (keyword) {
                    roomQuery.$or = [
                        { roomNumber: { $regex: keyword, $options: 'i' } },
                        { type: { $regex: keyword, $options: 'i' } }
                    ];
                }
                if (roomType) {
                    roomQuery.type = roomType;
                }
                if (roomStatus) {
                    roomQuery.status = roomStatus;
                }
                return Room.find(roomQuery)
                    .select('roomNumber type district status')
                    .skip((pageNum - 1) * sizeNum)
                    .limit(sizeNum);
            },

            contract: () => Contract.find({
                contractCode: { $regex: keyword, $options: 'i' }
            })
            .select('contractCode tenantId')
            .populate('tenantId', 'fullName')
            .skip((pageNum - 1) * sizeNum)
            .limit(sizeNum),

            bill: () => Bill.find({
                billCode: { $regex: keyword, $options: 'i' }
            })
            .select('billCode roomId')
            .populate('roomId', 'roomNumber')
            .skip((pageNum - 1) * sizeNum)
            .limit(sizeNum),

            complaint: () => Complaint.find({
                $or: [
                    { title: { $regex: keyword, $options: 'i' } },
                    { description: { $regex: keyword, $options: 'i' } }
                ]
            })
            .select('title description tenantId')
            .populate('tenantId', 'fullName')
            .skip((pageNum - 1) * sizeNum)
            .limit(sizeNum)
        };

        // Chỉ search theo type nếu có, nếu không thì search tất cả
        let results = [];
        if (type && queries[type]) {
            const items = await queries[type]();
            results = items.map(item => {
                switch (type) {
                    case 'tenant':
                        return {
                            id: item._id,
                            type: 'tenant',
                            title: item.fullName,
                            description: `${item.phone || 'N/A'} - ${item.email || 'N/A'}`
                        };
                    case 'room':
                        return {
                            id: item._id,
                            type: 'room',
                            title: `Phòng ${item.roomNumber}`,
                            description: `${item.type || ''} - ${item.status || ''}`
                        };
                    case 'contract':
                        return {
                            id: item._id,
                            type: 'contract',
                            title: `Hợp đồng: ${item.contractCode}`,
                            description: `Người thuê: ${item.tenantId?.fullName || 'N/A'}`
                        };
                    case 'bill':
                        return {
                            id: item._id,
                            type: 'bill',
                            title: `Hóa đơn: ${item.billCode}`,
                            description: `Phòng: ${item.roomId?.roomNumber || 'N/A'}`
                        };
                    case 'complaint':
                        return {
                            id: item._id,
                            type: 'complaint',
                            title: item.title,
                            description: `Người gửi: ${item.tenantId?.fullName || 'N/A'}`
                        };
                    default:
                        return null;
                }
            });
        } else {
            const [tenants, rooms, contracts, bills, complaints] = await Promise.all([
                queries.tenant(),
                queries.room(),
                queries.contract(),
                queries.bill(),
                queries.complaint()
            ]);
            results = [
                ...tenants.map(item => ({
                    id: item._id,
                    type: 'tenant',
                    title: item.fullName,
                    description: `${item.phone || 'N/A'} - ${item.email || 'N/A'}`
                })),
                ...rooms.map(item => ({
                    id: item._id,
                    type: 'room',
                    title: `Phòng ${item.roomNumber}`,
                    description: `${item.type || ''} - ${item.status || ''}`
                })),
                ...contracts.map(item => ({
                    id: item._id,
                    type: 'contract',
                    title: `Hợp đồng: ${item.contractCode}`,
                    description: `Người thuê: ${item.tenantId?.fullName || 'N/A'}`
                })),
                ...bills.map(item => ({
                    id: item._id,
                    type: 'bill',
                    title: `Hóa đơn: ${item.billCode}`,
                    description: `Phòng: ${item.roomId?.roomNumber || 'N/A'}`
                })),
                ...complaints.map(item => ({
                    id: item._id,
                    type: 'complaint',
                    title: item.title,
                    description: `Người gửi: ${item.tenantId?.fullName || 'N/A'}`
                }))
            ];
        }

        return res.status(200).json({
            success: true,
            data: results,
            page: pageNum,
            pageSize: sizeNum,
            total: results.length
        });
    } catch (error) {
        console.error('Search error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};