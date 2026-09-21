import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import {
  cancelDocument, createDocument, getDocumentById, listDocumentEvents, listDocuments, updateDocument,
} from './inventory-document.service.js';

export const getDocuments = asyncHandler(async (req,res)=>sendSuccess(res,{message:'Inventory documents loaded successfully.',data:{documents:await listDocuments(req.query,req.workspace.storeId)}}));
export const getDocument = asyncHandler(async (req,res)=>sendSuccess(res,{message:'Inventory document loaded successfully.',data:{document:await getDocumentById(req.params.id,req.workspace.storeId)}}));
export const getDocumentEvents = asyncHandler(async (req,res)=>sendSuccess(res,{message:'Inventory document events loaded successfully.',data:{events:await listDocumentEvents(req.params.id,req.workspace.storeId)}}));
export const createInventoryDocument = asyncHandler(async (req,res)=>sendSuccess(res,{message:'Inventory document draft created successfully.',statusCode:201,data:{document:await createDocument(req.body,req.user,req.workspace)}}));
export const updateInventoryDocument = asyncHandler(async (req,res)=>sendSuccess(res,{message:'Inventory document draft updated successfully.',data:{document:await updateDocument(req.params.id,req.body,req.user,req.workspace)}}));
export const cancelInventoryDocument = asyncHandler(async (req,res)=>sendSuccess(res,{message:'Inventory document cancelled successfully.',data:{document:await cancelDocument(req.params.id,req.user,req.workspace)}}));
