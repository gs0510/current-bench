open Current.Syntax

let get_job_id x =
  let+ md = Current.Analysis.metadata x in
  match md with Some { Current.Metadata.job_id; _ } -> job_id | None -> None

module Docker_util = struct
  module Docker = Current_docker.Default
  module Image = Current_docker.Raw.Image
  module Cmd = Current_docker.Raw.Cmd

  module Pread_log_builder = struct
    open Lwt.Infix

    type t = { pool : unit Current.Pool.t option }

    let id = "docker-pread"

    module Key = struct
      type t = {
        image : Image.t;
        args : string list;
        docker_context : string option;
        run_args : string list;
      }

      let pp_args = Fmt.(list ~sep:sp (quote string))

      let cmd { image; args; docker_context; run_args } =
        Cmd.docker ~docker_context
        @@ [ "run" ]
        @ run_args
        @ [ "--rm"; "-i"; Image.hash image ]
        @ args

      let pp f t = Cmd.pp f (cmd t)

      let digest { image; args; docker_context; run_args } =
        Yojson.Safe.to_string
        @@ `Assoc
             [
               ("image", `String (Image.hash image));
               ("args", `List (List.map (fun arg -> `String arg) args));
               ( "docker_context",
                 docker_context
                 |> Option.map (fun x -> `String x)
                 |> Option.value ~default:`Null );
               ("run_args", `List (List.map (fun arg -> `String arg) run_args));
             ]
    end

    module Value = Current.String

    let build { pool } job key =
      Current.Job.start job ?pool ~level:Current.Level.Average >>= fun () ->
      Current.Process.check_output ~cancellable:true ~job (Key.cmd key)
      >>= fun output_result ->
      match output_result with
      | Ok output ->
          Current.Job.log job "Output:\n%s" output;
          Lwt.return output_result
      | Error (`Msg msg) ->
          Current.Job.log job "Error: %s" msg;
          Lwt.return output_result

    let pp = Key.pp

    let auto_cancel = true
  end

  module Pread_log = Current_cache.Make (Pread_log_builder)

  module Raw = struct
    let pread_log ~docker_context ?pool ?(run_args = []) image ~args =
      let image =
        Current_docker.Default.Image.hash image
        |> Current_docker.Raw.Image.of_hash
      in
      Pread_log.get { Pread_log_builder.pool }
        { Pread_log_builder.Key.image; args; docker_context; run_args }
  end

  let pp_sp_label = Fmt.(option (sp ++ string))

  let pread_log ?label ?pool ?run_args image ~args =
    Current.component "pread_log%a" pp_sp_label label
    |> let> image = image in
       Raw.pread_log ~docker_context:Docker.docker_context ?pool ?run_args image
         ~args
end
