import { NextFunction, Request, Response } from "express"
import { catchAsync } from "../../utils/catchAsync"
//import { sendResponse } from "../../utils/sendResponse "
import httpStatus from "http-status-codes"
import { gearService } from "./gear.service"
import { sendResponse } from "../../utils/sendResponse"


const createGear = catchAsync(async (req: Request, res: Response, next: NextFunction) => {

    const providerId = req.user?.id
    const payload = req.body

    const result = await gearService.createGear(providerId as string, payload)

    

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.CREATED,
        message: "Gear created successfully",
        data: result
    })
})

const getAllGears = catchAsync(async (req: Request, res: Response,  next: NextFunction) => {
    const result = await gearService.getAllGear({})

    //console.log(result);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Gears fetched successfully",
        data: result
    })
})

const getGearById = catchAsync(async (req: Request, res: Response,  next: NextFunction) => {
    const gearId = req.params.id

    if(!gearId){
        throw new Error("Gear ID is required in the request parameters")
    }

    const result = await gearService.getGearById(gearId as string)

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Gear fetched successfully",
        data: result
    })
})

const updateGear = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const authorId = req.user?.id
    const isAdmin = req.user?.role === "ADMIN"
    const gearId = req.params.id
    const payload = req.body
    
    const result = await gearService.updateGear(gearId as string, payload, authorId as string, isAdmin)

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Gear updated successfully",
        data: result
    })
})

const deleteGear = catchAsync(async (req: Request, res: Response,  next: NextFunction) => {
    const authorId = req.user?.id
    const isAdmin = req.user?.role === "ADMIN"

    if (!req.params.id) {
        throw new Error("Gear ID is required in the request parameters")
    }
    const gearId = req.params.id

    await gearService.deleteGear(gearId as string, authorId as string, isAdmin)

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Gear deleted successfully",
        data: null
    })
})

const getGearsStats =catchAsync( async (req: Request, res: Response,  next: NextFunction) => {

    const result = await gearService.getGearsStats()

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Gears stats retrieved successfully",
        data: result
    })
})

const getMyGear = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const authorId = req.user?.id 

    const result = await gearService.getMyGear(authorId as string)

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "My gears fetched successfully",
        data: result
    })
})

export const gearController = {
    createGear,
    getAllGears,
    getGearById,
    updateGear,
    deleteGear,
    getGearsStats,
    getMyGear
}